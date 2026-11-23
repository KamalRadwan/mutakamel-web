import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { TenantScopeState } from '../../../core/scope/tenant-scope';
import { ApiError } from '../../../core/api/api-errors';
import { RecordHistoryApi } from './record-history.api';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { AuditEvent, AuditHistoryGroup } from '../../../features/workspace/operations/audit-log/audit-log.api';
import {
  historyItemFromEvent,
  historyItemFromGroup,
  listRecordHistory,
  planHistoryCategory,
  relatedPartyIdsFor,
} from './record-history.api';
import { HistoryItem } from './record-history.model';
import { fakeListRecordHistory } from './record-history.fake';

const V7 = (n: number) => `0192b7ea-7c4f-7a7d-9c9f-${String(n).padStart(12, '0')}`;

function item(partial: Partial<HistoryItem>): HistoryItem {
  return {
    id: 'h',
    action: 'UPDATE',
    subjectKind: 'lead',
    subjectId: null,
    referenceLabel: null,
    createdAt: '2026-11-20T10:00:00.000Z',
    actorLabel: null,
    actorType: 'USER',
    outcome: 'SUCCESS',
    reason: null,
    diff: [],
    ...partial,
  };
}

describe('record-history.api over the audit-log wrappers', () => {
  it('maps widget filters to backend historyCategory values', () => {
    expect(planHistoryCategory(undefined)).toEqual({});
    expect(planHistoryCategory('contact')).toEqual({ backend: 'contact' });
    expect(planHistoryCategory('record').backend).toBe('lead');
    expect(planHistoryCategory('details').backend).toBe('lead');
    const stages = planHistoryCategory('stages');
    expect(stages.backend).toBe('lead');
    expect(stages.keep?.(item({ action: 'OPPORTUNITY_STAGE_CHANGED' }))).toBe(true);
    expect(stages.keep?.(item({ action: 'OPPORTUNITY_UPDATED' }))).toBe(false);
    const note = planHistoryCategory('note');
    expect(note.backend).toBeUndefined();
    expect(note.keep?.(item({ subjectKind: 'note' }))).toBe(true);
  });

  it('sends only 1..21 unique UUIDv7 related party ids', () => {
    const ids = Array.from({ length: 25 }, (_, i) => V7(i));
    expect(relatedPartyIdsFor([...ids, ids[0], 'party-c-1-2'])).toEqual(ids.slice(0, 21));
    expect(relatedPartyIdsFor(['party-c-1-2'])).toEqual([]);
  });

  it('keeps grouped rows as they are and maps flat events like the grouped view', () => {
    const group: AuditHistoryGroup = {
      ...item({ id: 'g1' }),
      subjectKind: 'contact',
      diff: [{ field: 'phone', before: 'a', after: 'b' }],
    };
    expect(historyItemFromGroup(group)).toEqual(group);
    const event = {
      id: 'e1',
      action: 'CUSTOMER_PROFILE_UPDATED',
      entityType: 'CustomerProfile',
      entityId: V7(1),
      entityLabel: 'Acme Retail',
      createdAt: '2026-11-20T10:00:00.000Z',
      actorLabel: 'Mona Adel',
      actorType: 'USER',
      outcome: 'SUCCESS',
      reason: null,
      diff: null,
      before: { status: 'PROSPECT', updatedAt: 'x' },
      after: { status: 'INACTIVE', updatedAt: 'y' },
    } as unknown as AuditEvent;
    const mapped = historyItemFromEvent(event);
    expect(mapped.subjectKind).toBe('lead');
    expect(mapped.referenceLabel).toBe('Acme Retail');
    expect(mapped.diff).toEqual([{ field: 'status', before: 'PROSPECT', after: 'INACTIVE' }]);
  });

});

describe('RecordHistoryApi', () => {
  let api: RecordHistoryApi;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), { provide: TenantScopeState, useValue: { me: signal(null), selection: signal(null) } }] });
    api = TestBed.inject(RecordHistoryApi); http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it.each([
    { name: 'API compatibility export', list: listRecordHistory },
    { name: 'legacy compatibility alias', list: fakeListRecordHistory },
  ])('delegates $name to the real injected service', async ({ list }) => {
    const pending = TestBed.runInInjectionContext(() => list('Lead', V7(1), [], { limit: 1 }));
    const request = http.expectOne((r) => r.url.endsWith(`/records/CRM/LEAD/${V7(1)}/history`));
    expect(request.request.params.get('limit')).toBe('1');
    request.flush({ success: true, data: { items: [], nextCursor: null } });
    await expect(pending).resolves.toEqual({ items: [], nextCursor: null });
  });
  it('entity history unwraps the page', async () => {
    const pending = api.listRecordHistory('Party', V7(1), []);
    http.expectOne((r) => r.url === `/api/tenant/core/v1/audit/entities/Party/${V7(1)}`).flush({ success: true, data: { items: [], nextCursor: 'cursor-1' } });
    await expect(pending).resolves.toEqual({ items: [], nextCursor: 'cursor-1' });
  });
  it('uses the lead route without party ids and the related entity route with CSV', async () => {
    const lead = api.listRecordHistory('Lead', V7(1), [V7(2)], { category: 'stages', cursor: 'cursor-1' });
    const request = http.expectOne((r) => r.url.endsWith(`/records/CRM/LEAD/${V7(1)}/history`));
    expect(request.request.params.has('relatedPartyIds')).toBe(false);
    expect(request.request.params.get('historyCategory')).toBe('lead');
    expect(request.request.params.get('cursor')).toBe('cursor-1');
    request.flush({ success: true, data: { items: [item({ id: 'a', action: 'LEAD_STAGE_CHANGED' }), item({ id: 'b' })], nextCursor: 'next' } });
    expect((await lead).items.map((row) => row.id)).toEqual(['a']);
    const related = api.listRecordHistory('CustomerProfile', V7(1), [V7(2), V7(3)], { category: 'contact' });
    const relatedRequest = http.expectOne((r) => r.url.endsWith(`/entities/CustomerProfile/${V7(1)}`));
    expect(relatedRequest.request.params.get('relatedPartyIds')).toBe(`${V7(2)},${V7(3)}`);
    expect(relatedRequest.request.params.get('historyCategory')).toBe('contact');
    const contact = item({ id: 'contact', subjectKind: 'contact', diff: [
      { field: 'phone', before: 'old', after: 'new', subjectId: V7(2), subjectLabel: 'Contact' },
    ] });
    relatedRequest.flush({ success: true, data: { items: [contact], nextCursor: 'related-next' } });
    await expect(related).resolves.toEqual({ items: [contact], nextCursor: 'related-next' });
  });

  it('maps flat events and applies categories locally without sending a grouped filter', async () => {
    const pending = api.listRecordHistory('Opportunity', V7(1), ['invalid'], { category: 'details', limit: 10 });
    const request = http.expectOne((r) => r.url.endsWith(`/entities/Opportunity/${V7(1)}`));
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.params.has('relatedPartyIds')).toBe(false);
    expect(request.request.params.has('historyCategory')).toBe(false);
    const event = {
      id: 'event', action: 'UPDATE', entityType: 'OpportunityEntity', entityId: V7(1),
      entityLabel: 'Opportunity', createdAt: '2026-11-20T10:00:00.000Z',
      actorLabel: null, actorType: 'USER', outcome: 'SUCCESS', reason: null,
      diff: [{ field: 'status', before: 'OPEN', after: 'WON' }, { field: 'version', before: 1, after: 2 }],
      before: null, after: null,
    };
    request.flush({ success: true, data: { items: [event, { ...event, id: 'note', entityType: 'Note' }], nextCursor: 'flat-next' } });
    await expect(pending).resolves.toEqual({ items: [item({
      id: 'event', subjectId: V7(1), referenceLabel: 'Opportunity',
      diff: [{ field: 'status', before: 'OPEN', after: 'WON' }],
    })], nextCursor: 'flat-next' });
  });

  it('preserves the cursor when a local category removes every row', async () => {
    const pending = api.listRecordHistory('Lead', V7(1), [], { category: 'note' });
    const request = http.expectOne((r) => r.url.endsWith(`/records/CRM/LEAD/${V7(1)}/history`));
    expect(request.request.params.has('historyCategory')).toBe(false);
    request.flush({ success: true, data: { items: [item({})], nextCursor: 'next' } });
    await expect(pending).resolves.toEqual({ items: [], nextCursor: 'next' });
  });

  for (const [status, code] of [
    [400, 'AUDIT_QUERY_INVALID'], [403, 'MISSING_REQUIRED_PERMISSIONS'],
    [404, 'ACTIVITY_NOT_FOUND'], [503, 'ACTIVITY_TARGET_UNAVAILABLE'],
  ] as const) {
    it(`passes ${code} through the shared API error handling`, async () => {
      const pending = api.listRecordHistory('Lead', V7(1), []);
      const rejected = expect(pending).rejects.toMatchObject({
        status, code, correlationId: 'history-request',
      });
      http.expectOne((r) => r.url.endsWith(`/records/CRM/LEAD/${V7(1)}/history`))
        .flush({ success: false, errorCode: code, correlationId: 'history-request' }, { status, statusText: 'Error' });
      await rejected;
    });
  }

  it('propagates network errors without returning fabricated history', async () => {
    const pending = api.listRecordHistory('Party', V7(1), [V7(2)]);
    const rejected = expect(pending).rejects.toBeInstanceOf(ApiError);
    const code = expect(pending).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    http.expectOne((r) => r.url.endsWith(`/entities/Party/${V7(1)}`)).error(new ProgressEvent('error'));
    await Promise.all([rejected, code]);
  });

  it('rejects a malformed success envelope', async () => {
    const pending = api.listRecordHistory('Party', V7(1), []);
    const rejected = expect(pending).rejects.toMatchObject({ status: 502, code: 'COMMON.GENERIC.INTERNAL_ERROR' });
    http.expectOne((r) => r.url.endsWith(`/entities/Party/${V7(1)}`)).flush({ items: [], nextCursor: null });
    await rejected;
  });
});
