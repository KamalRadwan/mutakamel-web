import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../shared/settings-api';
import { emailOptions, getEmail, listEmails, listSourceRecords, retryEmail, sendEmail } from './outbound-emails.api';
import {
  EmailDetail,
  EmailRow,
  canRetryEmail,
  feedbackReasonKey,
  mayOfferRetry,
  shortEmailRef,
} from './outbound-emails.model';

/** Runs the fake timers to completion and returns (or rethrows) the settled result. */
async function settle<T>(promise: Promise<T>): Promise<T> {
  const guarded = promise.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const result = await guarded;
  if (!result.ok) throw result.error;
  return result.value;
}

async function allRows(): Promise<EmailRow[]> {
  const rows: EmailRow[] = [];
  let cursor: string | null = null;
  do {
    const page: Awaited<ReturnType<typeof listEmails>> = await settle(listEmails({}, cursor));
    rows.push(...page.items);
    cursor = page.nextCursor;
  } while (cursor);
  return rows;
}

async function errorOf(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await settle(promise);
  } catch (error) {
    if (error instanceof ApiError) return error;
    throw error;
  }
  throw new Error('expected an ApiError');
}

/** Keys of `listProjection` in crm-app/src/crm/outbound-emails/outbound-emails.service.ts. */
const LIST_KEYS = [
  'activityId',
  'failedAt',
  'outboundEmailId',
  'recipient',
  'requestedAt',
  'requestedBy',
  'retryOfId',
  'sentAt',
  'sourceId',
  'sourceType',
  'status',
  'statusRevision',
  'subjectPreview',
  'templateDefinitionId',
  'templateVersionId',
  'templateVersionNumber',
];

/** Keys of `detailProjection` in the same service. */
const DETAIL_KEYS = [
  'activityId',
  'content',
  'contentRetentionDays',
  'contentRetentionPolicyRevision',
  'contentRetentionUntil',
  'failedAt',
  'failure',
  'feedback',
  'outboundEmailId',
  'provider',
  'recipient',
  'requestedAt',
  'retriedById',
  'retryOfId',
  'sender',
  'senderConfigRevision',
  'sentAt',
  'sourceId',
  'sourceType',
  'status',
  'statusRevision',
  'template',
  'timeline',
];

describe('outbound emails fake follows the backend projections', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('list rows carry flat source/template fields and no names', async () => {
    const rows = await allRows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(LIST_KEYS);
      expect(Object.keys(row.recipient).sort()).toEqual(['displayName', 'maskedAddress']);
      expect(Object.keys(row.requestedBy).sort()).toEqual(['displayName', 'id']);
      if (row.subjectPreview !== null) expect([...row.subjectPreview].length).toBeLessThanOrEqual(160);
    }
  });

  it('list subjectPreview is null once the content was removed', async () => {
    const rows = await allRows();
    const nullSubjects = rows.filter((row) => row.subjectPreview === null);
    expect(nullSubjects.length).toBeGreaterThan(0);
    const detail = await settle(getEmail(nullSubjects[0].outboundEmailId));
    expect(detail.content.state).toBe('REDACTED_BY_RETENTION');
    expect(detail.content).toHaveProperty('redactedAt');
  });

  it('detail has the backend shape: provider, failure code only, feedback reasonCode, timeline state', async () => {
    const rows = await allRows();
    const details: EmailDetail[] = [];
    for (const row of rows) details.push(await settle(getEmail(row.outboundEmailId)));

    for (const detail of details) {
      expect(Object.keys(detail).sort()).toEqual(DETAIL_KEYS);
      expect(detail).not.toHaveProperty('requestedBy');
      expect(detail).not.toHaveProperty('subjectPreview');
      expect(Object.keys(detail.sender).sort()).toEqual(['displayName', 'maskedAddress', 'maskedReplyTo']);
      expect(detail.recipient.kind).toBe('TO');
      expect(detail.template.documentType).toBe('CRM_OUTBOUND_EMAIL');
      for (const event of detail.timeline) expect(Object.keys(event).sort()).toEqual(['occurredAt', 'state']);
      if (detail.provider) expect(Object.keys(detail.provider).sort()).toEqual(['kind', 'submissionReference']);
      if (detail.status !== 'SENT') expect(detail.provider).toBeNull();
    }

    const failed = details.find((detail) => detail.failure);
    expect(failed?.failure && Object.keys(failed.failure).sort()).toEqual(['automaticRetryExhausted', 'code', 'failedAt']);

    const reasons = details.flatMap((detail) => detail.feedback.map((item) => item.reasonCode));
    expect(new Set(reasons)).toEqual(new Set(['HARD_BOUNCE', 'SOFT_BOUNCE', 'COMPLAINT']));
    const feedback = details.flatMap((detail) => detail.feedback)[0];
    expect(Object.keys(feedback).sort()).toEqual(['occurredAt', 'reasonCode', 'suppressionApplied', 'type']);
  });

  it('a retry starts with RETRY_REQUESTED and links both emails', async () => {
    const rows = await allRows();
    let original: EmailDetail | null = null;
    for (const row of rows.filter(mayOfferRetry)) {
      const detail = await settle(getEmail(row.outboundEmailId));
      if (canRetryEmail(detail)) {
        original = detail;
        break;
      }
    }
    expect(original).not.toBeNull();
    const result = await settle(retryEmail(original!.outboundEmailId, 'Mailbox fixed', 'key-retry-1'));
    const child = await settle(getEmail(result.outboundEmailId));
    expect(child.retryOfId).toBe(original!.outboundEmailId);
    expect(child.timeline[0].state).toBe('RETRY_REQUESTED');
    const reloaded = await settle(getEmail(original!.outboundEmailId));
    expect(reloaded.retriedById).toBe(result.outboundEmailId);
    expect(reloaded.timeline.some((event) => event.state === 'RETRY_REQUESTED')).toBe(false);

    const error = await errorOf(retryEmail(original!.outboundEmailId, 'Another reason', 'key-retry-1'));
    expect(error.status).toBe(422);
    expect(error.code).toBe('CRM.EMAIL.IDEMPOTENCY_MISMATCH');
  });

  it('options return recipient references with isPrimary and templates with templateVersionId', async () => {
    const [record] = await settle(listSourceRecords('LEAD'));
    const options = await settle(emailOptions({ sourceType: 'LEAD', sourceId: record.id, locale: 'en' }));
    expect(options.sourceType).toBe('LEAD');
    expect(options.sourceId).toBe(record.id);
    expect(options.resolvedLocale).toBe('en');
    for (const recipient of options.recipients) {
      expect(Object.keys(recipient).sort()).toEqual(['displayName', 'isPrimary', 'maskedAddress', 'reference']);
      expect(recipient.isPrimary).toBe(recipient.reference.kind === 'SOURCE_PRIMARY_CONTACT');
    }
    expect(options.templates.every((tpl) => typeof tpl.templateVersionId === 'string' && tpl.templateId)).toBe(true);
    const assigned = options.templates.find((tpl) => tpl.templateVersionId === options.assignedTemplateVersionId);
    expect(assigned?.selection).toBe('EFFECTIVE_ASSIGNMENT');
  });

  it('send accepts a recipient reference and rejects a reused key with CRM.EMAIL.IDEMPOTENCY_MISMATCH', async () => {
    const [record] = await settle(listSourceRecords('LEAD'));
    const options = await settle(emailOptions({ sourceType: 'LEAD', sourceId: record.id, locale: 'en' }));
    const body = {
      sourceType: 'LEAD' as const,
      sourceId: record.id,
      locale: 'en' as const,
      recipient: { ...options.recipients[0].reference },
      templateVersionId: options.assignedTemplateVersionId!,
    };
    const sent = await settle(sendEmail(body, 'key-send-1'));
    const detail = await settle(getEmail(sent.outboundEmailId));
    expect(detail.status).toBe('QUEUED');
    expect(detail.timeline).toEqual([{ state: 'QUEUED', occurredAt: detail.requestedAt }]);

    const error = await errorOf(sendEmail({ ...body, templateVersionId: options.templates[1].templateVersionId }, 'key-send-1'));
    expect(error.code).toBe('CRM.EMAIL.IDEMPOTENCY_MISMATCH');
  });
});

describe('outbound emails model helpers', () => {
  it('shortEmailRef shortens long ids only', () => {
    expect(shortEmailRef('0193f2a4-6c1e-7b3a-9d42-5e8a1c7f4a11')).toBe('0193…4a11');
    expect(shortEmailRef('eml-001')).toBe('eml-001');
    expect(shortEmailRef(null)).toBe('—');
  });

  it('feedbackReasonKey maps unknown codes to UNSPECIFIED', () => {
    expect(feedbackReasonKey('HARD_BOUNCE')).toBe('HARD_BOUNCE');
    expect(feedbackReasonKey('SOMETHING_ELSE')).toBe('UNSPECIFIED');
  });

  it('retry is offered for failed rows and allowed only for retained, not yet retried emails', () => {
    expect(mayOfferRetry({ status: 'FAILED' })).toBe(true);
    expect(mayOfferRetry({ status: 'SENT' })).toBe(false);
    const content = { state: 'AVAILABLE' as const, subject: 's', preheader: null, html: '', text: null, contentChecksum: 'c' };
    expect(canRetryEmail({ status: 'FAILED', content, retriedById: null })).toBe(true);
    expect(canRetryEmail({ status: 'FAILED', content, retriedById: 'eml-2' })).toBe(false);
    expect(
      canRetryEmail({ status: 'FAILED', content: { state: 'REDACTED_BY_RETENTION', redactedAt: 'x' }, retriedById: null }),
    ).toBe(false);
  });
});
